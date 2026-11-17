#!/usr/bin/env bash
# 统一自检入口（06-testing §3 契约：每条检查输出恰好一行摘要，详细日志入 scripts/.log/）。
# 先行实现范围：CHK-LINT / CHK-BUILD / CHK-DEP（前端部分）/ CHK-UNIT。
# CHK-IGS / CHK-API / CHK-DATA 为在线检查，由 R1（T-005）与联调期补全。
# 退出码：0=全部 PASS；1=至少一个 FAIL；2=脚本自身异常或环境不可用。
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FE="$ROOT/frontend"
LOG_DIR="$ROOT/scripts/.log"
mkdir -p "$LOG_DIR"

FINAL_EXIT=0

log_detail() {
  # $1=检查ID $2=内容（追加写入对应日志文件）
  printf '%s\n' "$2" >> "$LOG_DIR/$1.log"
}

run_npm_check() {
  # $1=检查ID $2=npm script 名 $3=成功摘要
  local id="$1" script="$2" ok_summary="$3" log
  if ! command -v npm >/dev/null 2>&1; then
    emit_result "$id" "FAIL" "npm 不存在，环境不可用"
    return 2
  fi
  log=$(cd "$FE" && npm run "$script" 2>&1)
  local code=$?
  printf '%s\n' "$log" > "$LOG_DIR/$id.log"
  if [ "$code" -eq 0 ]; then
    emit_result "$id" "PASS" "$ok_summary"
    return 0
  fi
  local first_fail
  first_fail=$(printf '%s\n' "$log" | grep -m1 -E "error|✖|failed|FAIL" || true)
  emit_result "$id" "FAIL" "exit=$code, first: ${first_fail:-见日志 $LOG_DIR/$id.log}"
  return 1
}

emit_result() {
  # $1=检查ID $2=PASS|FAIL $3=摘要
  echo "CHECK $1 $2 $3"
  if [ "$2" = "FAIL" ]; then
    FINAL_EXIT=1
  fi
}

check_lint() {
  run_npm_check "CHK-LINT" "lint" "0 errors"
}

check_build() {
  run_npm_check "CHK-BUILD" "build" "dist built"
}

check_unit() {
  run_npm_check "CHK-UNIT" "test:unit" "all spec passed"
}

check_dep() {
  local violations=0 first="" out mod_dir mod_name
  : > "$LOG_DIR/CHK-DEP.log"

  # $1=子项ID $2=正则 $3=目标 $4=排除正则(可空)
  dep_grep() {
    local sub_id="$1" pattern="$2" target="$3" exclude="${4:-}" out
    if [ ! -e "$target" ]; then
      return 0
    fi
    if [ -n "$exclude" ]; then
      out=$(grep -rEn -- "$pattern" "$target" 2>/dev/null | grep -v -E -- "$exclude" || true)
    else
      out=$(grep -rEn -- "$pattern" "$target" 2>/dev/null || true)
    fi
    if [ -n "$out" ]; then
      printf '[%s]\n%s\n' "$sub_id" "$out" >> "$LOG_DIR/CHK-DEP.log"
      violations=$((violations + 1))
      if [ -z "$first" ]; then
        first="$sub_id: $(printf '%s\n' "$out" | head -1)"
      fi
    fi
  }

  # DEP-03 core 纯净；DEP-04 api 纯净
  dep_grep "DEP-03" "from ['\"]@/(api|modules|components|stores)" "$FE/src/core" ""
  dep_grep "DEP-04" "from ['\"]@/(modules|components|stores)" "$FE/src/api" ""

  # DEP-05 模块互不引用（排除对自身模块目录的引用）
  if [ -d "$FE/src/modules" ]; then
    for mod_dir in "$FE/src/modules"/*/; do
      mod_name=$(basename "$mod_dir")
      dep_grep "DEP-05" "from ['\"]@/modules/" "$mod_dir" "@/modules/$mod_name"
    done
  fi

  dep_grep "DEP-06" "from ['\"]@/modules" "$FE/src/components" ""
  dep_grep "DEP-07" "from ['\"]\.\./\.\./" "$FE/src" ""
  dep_grep "DEP-08" "new Zondy" "$FE/src/modules" ""
  dep_grep "DEP-09" "127\.0\.0\.1|localhost:[0-9]+|:6163|:8080" "$FE/src" ""
  dep_grep "DEP-10" "tk=[0-9a-f]{16,}|key=[0-9a-f]{16,}" "$FE/src" ""
  dep_grep "DEP-11" "TODO|FIXME|XXX|console\.log" "$FE/src" ""

  # DEP-12 新旧库混用（index.html 中 zondyclientOld 计数必须为 0）
  if grep -q "zondyclientOld" "$FE/index.html" 2>/dev/null; then
    printf '[DEP-12]\nzondyclientOld found in index.html\n' >> "$LOG_DIR/CHK-DEP.log"
    violations=$((violations + 1))
    if [ -z "$first" ]; then
      first="DEP-12: zondyclientOld found in index.html"
    fi
  fi

  if [ "$violations" -eq 0 ]; then
    emit_result "CHK-DEP" "PASS" "0 violations"
  else
    emit_result "CHK-DEP" "FAIL" "$violations violation(s), first: $first"
  fi
}

usage() {
  echo "用法: scripts/check.sh <CHECK_ID>... | all" >&2
  echo "可用: CHK-LINT CHK-BUILD CHK-DEP CHK-UNIT all" >&2
}

main() {
  if [ $# -eq 0 ]; then
    usage
    exit 2
  fi
  for arg in "$@"; do
    case "$arg" in
      CHK-LINT) check_lint ;;
      CHK-BUILD) check_build ;;
      CHK-DEP) check_dep ;;
      CHK-UNIT) check_unit ;;
      all) check_lint; check_build; check_dep; check_unit ;;
      *) usage; exit 2 ;;
    esac
  done
  exit "$FINAL_EXIT"
}

main "$@"
