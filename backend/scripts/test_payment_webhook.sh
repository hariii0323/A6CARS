#!/usr/bin/env bash
# Test the server-side mock webhook flow
set -euo pipefail
BASE=http://localhost:4000/api
atoken=$(curl -sS -X POST $BASE/login -H 'Content-Type: application/json' -d '{"email":"hari0323","password":"Anu"}' | jq -r .token)
# create user
u=$(curl -sS -X POST $BASE/signup -H 'Content-Type: application/json' -d '{"name":"WebhookUser","email":"webhookuser@example.com","password":"pwwebhook"}')
uid=$(echo $u | jq -r .id)
utoken=$(curl -sS -X POST $BASE/login -H 'Content-Type: application/json' -d '{"email":"webhookuser@example.com","password":"pwwebhook"}' | jq -r .token)
# admin add car
carid=$(curl -sS -X POST $BASE/cars -H "Authorization: Bearer $atoken" -H 'Content-Type: application/json' -d '{"reg_no":"WH-001","brand":"WH","model":"W1","model_year":2025,"location":"WH Lot","price_per_day":100}' | jq -r .id)
# user books (pending)
start=$(date -d '+8 days' +%F)
end=$(date -d '+10 days' +%F)
payid=$(curl -sS -X POST $BASE/payments -H "Authorization: Bearer $utoken" -H 'Content-Type: application/json' -d "{\"car_id\":$carid,\"amount\":300,\"payment_method\":\"QR\",\"qr_payload\":\"8179134484@pthdfc|amount:300|car:$carid\",\"start_date\":\"$start\",\"end_date\":\"$end\"}" | jq -r .id)
echo "pending payment id: $payid"
# request webhook token
wtoken=$(curl -sS -X POST $BASE/mock-webhook-tokens -H "Authorization: Bearer $utoken" -H 'Content-Type: application/json' -d "{\"payment_id\":$payid}" | jq -r .token)
echo "webhook token: $wtoken"
# call webhook (server-side) simulating payment gateway
curl -sS -X POST $BASE/mock-webhook -H 'Content-Type: application/json' -d "{\"token\":\"$wtoken\"}" | jq .
# admin verify
curl -sS -X POST $BASE/payments/$payid/verify -H "Authorization: Bearer $atoken" -H 'Content-Type: application/json' -d '{"verified":true}' | jq .
# show booking
curl -sS $BASE/cars/$carid -H "Authorization: Bearer $atoken" | jq .
