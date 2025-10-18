#!/usr/bin/env bash
# Simple integration test: signup/login, admin login, add car, book car, verify booking
set -euo pipefail
BASE=http://localhost:4000/api
# create test user
u=$(curl -sS -X POST $BASE/signup -H 'Content-Type: application/json' -d '{"name":"ITest","email":"itest@example.com","password":"pwtest"}')
uid=$(echo $u | jq -r .id)
echo "created user $uid"
# login user
utoken=$(curl -sS -X POST $BASE/login -H 'Content-Type: application/json' -d '{"email":"itest@example.com","password":"pwtest"}' | jq -r .token)
echo "user token: ${utoken:0:10}..."
# admin login
atoken=$(curl -sS -X POST $BASE/login -H 'Content-Type: application/json' -d '{"email":"hari0323","password":"Anu"}' | jq -r .token)
echo "admin token: ${atoken:0:10}..."
# admin add car
carid=$(curl -sS -X POST $BASE/cars -H "Authorization: Bearer $atoken" -H 'Content-Type: application/json' -d '{"reg_no":"ITEST-001","brand":"ITest","model":"M1","model_year":2025,"location":"Lot Test","price_per_day":100}' | jq -r .id)
echo "added car $carid"
# user book car
start=$(date -d '+2 days' +%F)
end=$(date -d '+4 days' +%F)
payid=$(curl -sS -X POST $BASE/payments -H "Authorization: Bearer $utoken" -H 'Content-Type: application/json' -d "{\"car_id\":$carid,\"amount\":300,\"payment_method\":\"QR\",\"qr_payload\":\"8179134484@pthdfc|amount:300|car:$carid\",\"start_date\":\"$start\",\"end_date\":\"$end\"}" | jq -r .id)
echo "payment created $payid"
# admin verify
curl -sS -X POST $BASE/payments/$payid/verify -H "Authorization: Bearer $atoken" -H 'Content-Type: application/json' -d '{"verified":true}' | jq .
# show bookings
curl -sS $BASE/cars/$carid -H "Authorization: Bearer $atoken" | jq .
