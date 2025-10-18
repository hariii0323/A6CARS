#!/usr/bin/env bash
# Test flow: create user, admin adds car, user books (pending), simulate payment confirm, admin verifies
set -euo pipefail
BASE=http://localhost:4000/api
atoken=$(curl -sS -X POST $BASE/login -H 'Content-Type: application/json' -d '{"email":"hari0323","password":"Anu"}' | jq -r .token)
# create user
u=$(curl -sS -X POST $BASE/signup -H 'Content-Type: application/json' -d '{"name":"PopupUser","email":"popupuser@example.com","password":"pwpopup"}')
uid=$(echo $u | jq -r .id)
utoken=$(curl -sS -X POST $BASE/login -H 'Content-Type: application/json' -d '{"email":"popupuser@example.com","password":"pwpopup"}' | jq -r .token)
# admin add car
carid=$(curl -sS -X POST $BASE/cars -H "Authorization: Bearer $atoken" -H 'Content-Type: application/json' -d '{"reg_no":"POP-001","brand":"Popup","model":"P1","model_year":2025,"location":"Popup Lot","price_per_day":100}' | jq -r .id)
# user books (pending)
start=$(date -d '+5 days' +%F)
end=$(date -d '+7 days' +%F)
payid=$(curl -sS -X POST $BASE/payments -H "Authorization: Bearer $utoken" -H 'Content-Type: application/json' -d "{\"car_id\":$carid,\"amount\":300,\"payment_method\":\"QR\",\"qr_payload\":\"8179134484@pthdfc|amount:300|car:$carid\",\"start_date\":\"$start\",\"end_date\":\"$end\"}" | jq -r .id)
echo "pending payment id: $payid"
# simulate user clicking 'I paid' -> confirm
curl -sS -X POST $BASE/payments/$payid/confirm -H "Authorization: Bearer $utoken" -H 'Content-Type: application/json' -d '{}' | jq .
# admin verify
curl -sS -X POST $BASE/payments/$payid/verify -H "Authorization: Bearer $atoken" -H 'Content-Type: application/json' -d '{"verified":true}' | jq .
# show booking
curl -sS $BASE/cars/$carid -H "Authorization: Bearer $atoken" | jq .
