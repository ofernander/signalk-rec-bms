#!/bin/bash
# signalk-rec-bms-setup.sh
# Venus OS setup script for signalk-rec-bms
#
# Reserves the REC-BMS serial adapter so Venus OS serial-starter
# leaves it alone and SignalK can own it cleanly.
#
# Usage:
#   Interactive install:  bash setup.sh
#   Uninstall:            bash setup.sh --uninstall
#   Silent boot mode:     bash setup.sh --boot  (called by rc.local, not for manual use)

# exit on unhandled errors
set -e

# trap unexpected exits and inform the user
trap 'echo ""; echo "ERROR: Setup was interrupted unexpectedly. Run the script again to retry."; exit 1' ERR

STORED_SERIAL="/data/conf/signalk-rec-bms"
UDEV_RULES="/etc/udev/rules.d/zz-signalk-rec-bms.rules"
RC_LOCAL="/data/rc.local"
SELF="/root/signalk-rec-bms-venusOS.sh"


# -------------------------------------------------------
# BOOT MODE
# Called by rc.local on every boot.
# Silent - re-applies the udev rule after firmware updates
# restore the read-only filesystem.
# -------------------------------------------------------
if [ "$1" = "--boot" ]; then
    if [ ! -f "$STORED_SERIAL" ]; then
        exit 0
    fi

    stored=$(cat "$STORED_SERIAL")
    if [ -z "$stored" ]; then
        exit 0
    fi

    if [ ! -f "/opt/victronenergy/swupdate-scripts/remount-rw.sh" ]; then
        exit 0
    fi
    bash /opt/victronenergy/swupdate-scripts/remount-rw.sh

    echo "# signalk-rec-bms: reserve device for SignalK" > "$UDEV_RULES"
    echo "ACTION==\"add\", ENV{ID_BUS}==\"usb\", ATTRS{serial}==\"${stored}\", ENV{VE_SERVICE}=\"ignore\"" >> "$UDEV_RULES"

    udevadm control --reload-rules

    exit 0
fi


# -------------------------------------------------------
# UNINSTALL MODE
# -------------------------------------------------------
if [ "$1" = "--uninstall" ]; then
    echo ""
    echo "signalk-rec-bms Venus OS Uninstall"
    echo "===================================="
    echo ""

    read -p "Remove signalk-rec-bms device reservation? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi

    echo "Remounting filesystem read-write..."
    bash /opt/victronenergy/swupdate-scripts/remount-rw.sh

    # remove udev rules file
    if [ -f "$UDEV_RULES" ]; then
        rm -f "$UDEV_RULES"
        echo "Removed udev rules file."
    fi

    # remove rc.local entry
    if [ -f "$RC_LOCAL" ]; then
        sed -i "\|bash $SELF --boot|d" "$RC_LOCAL"
        echo "Removed boot hook from rc.local."
    fi

    # remove stored serial
    if [ -f "$STORED_SERIAL" ]; then
        rm -f "$STORED_SERIAL"
        echo "Removed stored device serial."
    fi

    # remove self from persistent location
    if [ -f "$SELF" ]; then
        rm -f "$SELF"
        echo "Removed setup script from /data/conf."
    fi

    # reload udev — does not affect other devices
    udevadm control --reload-rules

    # restart serial-starter so it resumes managing the device
    svc -t /service/serial-starter

    echo ""
    echo "Uninstall complete."
    echo "Unplug and replug your RS485 adapter for serial-starter to resume managing the device."
    echo ""
    exit 0
fi


# -------------------------------------------------------
# INTERACTIVE INSTALL MODE
# -------------------------------------------------------
echo ""
echo "signalk-rec-bms Venus OS Setup"
echo "================================"
echo ""


# -------------------------------------------------------
# STEP 1 - Check we are on Venus OS
# -------------------------------------------------------
if [ ! -f "/opt/victronenergy/version" ]; then
    echo "ERROR: This script is for Venus OS only."
    exit 1
fi

echo "Venus OS $(head -n 1 /opt/victronenergy/version) detected."
echo ""


# -------------------------------------------------------
# STEP 2 - Scan for USB serial devices
# -------------------------------------------------------
echo "Scanning for USB serial devices..."
echo ""

devices=()
serials=()
descriptions=()

for tty in /dev/ttyUSB* /dev/ttyACM*; do
    [ -e "$tty" ] || continue
    name=$(basename $tty)
    serial=$(udevadm info -q property -n $tty 2>/dev/null | grep "^ID_SERIAL_SHORT=" | cut -d= -f2)
    product=$(udevadm info -q property -n $tty 2>/dev/null | grep "^ID_MODEL=" | cut -d= -f2 | tr '_' ' ')
    vendor=$(udevadm info -q property -n $tty 2>/dev/null | grep "^ID_VENDOR=" | cut -d= -f2 | tr '_' ' ')
    devices+=("$name")
    serials+=("$serial")
    descriptions+=("$vendor $product [serial: ${serial:-unknown}]")
done

if [ ${#devices[@]} -eq 0 ]; then
    echo "ERROR: No USB serial devices found."
    echo "Connect your RS485 adapter and run this script again."
    exit 1
fi

echo "Found the following USB serial devices:"
echo ""
for i in "${!devices[@]}"; do
    echo "  [$((i+1))] ${devices[$i]}  -  ${descriptions[$i]}"
done
uninstall_option=$(( ${#devices[@]} + 1 ))
echo "  [$uninstall_option] Uninstall signalk-rec-bms Venus OS setup"
echo ""


# -------------------------------------------------------
# STEP 3 - User selects the BMS device
# -------------------------------------------------------
read -p "Enter the number of the device connected to your REC-BMS: " selection

# handle uninstall option
if [ "$selection" = "$uninstall_option" ]; then
    exec bash "$0" --uninstall
fi

if ! [[ "$selection" =~ ^[0-9]+$ ]] || \
   [ "$selection" -lt 1 ] || \
   [ "$selection" -gt "${#devices[@]}" ]; then
    echo "Invalid selection. Exiting."
    exit 1
fi

idx=$((selection-1))
selected_tty="${devices[$idx]}"
selected_serial="${serials[$idx]}"
selected_desc="${descriptions[$idx]}"

echo ""
echo "Selected: $selected_tty  -  $selected_desc"
echo ""

if [ -z "$selected_serial" ]; then
    echo "ERROR: Could not read USB serial number for this device."
    echo "The reservation requires a USB serial number to survive reboots."
    echo "Try a different adapter or check dmesg for device details."
    exit 1
fi


# -------------------------------------------------------
# STEP 4 - Confirm
# -------------------------------------------------------
read -p "Reserve $selected_tty for signalk-rec-bms? [y/N]: " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi


# -------------------------------------------------------
# STEP 5 - Store USB serial number persistently
# -------------------------------------------------------
echo ""
echo "Storing device serial number..."
echo "$selected_serial" > "$STORED_SERIAL"


# -------------------------------------------------------
# STEP 6 - Remount root filesystem read-write
# -------------------------------------------------------
echo "Remounting filesystem read-write..."
bash /opt/victronenergy/swupdate-scripts/remount-rw.sh


# -------------------------------------------------------
# STEP 7 - Write udev rule targeting this specific device
# VE_SERVICE=ignore tells serial-starter to leave it alone
# -------------------------------------------------------
echo "Writing udev rule..."

echo "# signalk-rec-bms: reserve device for SignalK" > "$UDEV_RULES"
echo "ACTION==\"add\", ENV{ID_BUS}==\"usb\", ATTRS{serial}==\"${selected_serial}\", ENV{VE_SERVICE}=\"ignore\"" >> "$UDEV_RULES"

echo "Reloading udev rules..."
udevadm control --reload-rules
udevadm trigger


# -------------------------------------------------------
# STEP 8 - Persist across Venus OS firmware updates
# Firmware updates restore the read-only filesystem,
# wiping the udev rule. rc.local re-applies it on boot.
# This script copies itself to /data/conf so it survives
# and is called from rc.local on every boot.
# -------------------------------------------------------
echo "Installing boot hook..."

cp "$0" "$SELF"
chmod +x "$SELF"

if [ ! -f "$RC_LOCAL" ]; then
    echo "#!/bin/bash" > "$RC_LOCAL"
    chmod 755 "$RC_LOCAL"
fi

grep -qxF "bash $SELF --boot" "$RC_LOCAL" || \
    echo "bash $SELF --boot" >> "$RC_LOCAL"


# -------------------------------------------------------
# STEP 9 - Restart serial-starter to pick up the change
# -------------------------------------------------------
echo "Restarting serial-starter..."
svc -t /service/serial-starter


echo ""
echo "Done."
echo ""
echo "  Device:  $selected_tty"
echo "  Serial:  $selected_serial"
echo "  Status:  Reserved for signalk-rec-bms"
echo ""
echo "Serial-starter will not probe or claim this device."
echo "Unplug and replug your RS485 adapter now, then start the SignalK plugin."
echo ""
echo "To undo this at any time: bash $SELF --uninstall"
echo ""
