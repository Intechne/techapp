#!/usr/bin/env bash
# Soğuk açılış ölçümü: force-stop → am start -W → TotalTime (ms). 10 koşu, medyan + en kötü.
# Kullanım: ADB=/yol/adb RUNS=10 SERIAL=emulator-5554 ./cold-start.sh
# Yalnız kurulu uygulamayı başlatır; kurmaz, silmez, oturum açmaz/kapatmaz.
set -euo pipefail

ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
PKG="${PKG:-com.intechne.techapp}"
RUNS="${RUNS:-10}"
SETTLE="${SETTLE:-4}" # her koşudan sonra bekleme (sn)
ADB_ARGS=()
[ -n "${SERIAL:-}" ] && ADB_ARGS=(-s "$SERIAL")
adb() { "$ADB" ${ADB_ARGS[@]+"${ADB_ARGS[@]}"} "$@"; }

adb get-state >/dev/null 2>&1 || { echo "cihaz/emülatör bulunamadı" >&2; exit 1; }

model=$(adb shell getprop ro.product.model | tr -d '\r')
android=$(adb shell getprop ro.build.version.release | tr -d '\r')
sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
abi=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
qemu=$(adb shell getprop ro.kernel.qemu | tr -d '\r')
vname=$(adb shell dumpsys package "$PKG" | grep -m1 versionName | sed 's/.*versionName=//' | tr -d '\r')
vcode=$(adb shell dumpsys package "$PKG" | grep -m1 versionCode | sed 's/.*versionCode=\([0-9]*\).*/\1/' | tr -d '\r')

echo "# Soğuk açılış — $PKG"
echo "# Cihaz: $model · Android $android (API $sdk) · $abi · emülatör=$([ "$qemu" = 1 ] && echo evet || echo hayır)"
echo "# Uygulama: versionName=$vname versionCode=$vcode"
echo "# Tarih: $(date '+%Y-%m-%d %H:%M:%S') · koşu: $RUNS"

times=()
for i in $(seq 1 "$RUNS"); do
  adb shell am force-stop "$PKG"
  sleep 2
  out=$(adb shell am start -W -n "$PKG/.MainActivity" | tr -d '\r')
  t=$(echo "$out" | awk -F': ' '/TotalTime/ {print $2}')
  if [ -z "$t" ]; then echo "koşu $i: TotalTime okunamadı" >&2; echo "$out" >&2; exit 1; fi
  echo "koşu $i: TotalTime ${t} ms"
  times+=("$t")
  sleep "$SETTLE"
done

sorted=($(printf '%s\n' "${times[@]}" | sort -n))
n=${#sorted[@]}
if [ $((n % 2)) -eq 1 ]; then median=${sorted[$((n / 2))]}; else median=$(( (sorted[n/2-1] + sorted[n/2]) / 2 )); fi
echo "medyan: ${median} ms"
echo "en kötü: ${sorted[$((n - 1))]} ms (en iyi: ${sorted[0]} ms)"
