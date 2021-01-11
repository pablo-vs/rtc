#!/bin/bash

mkdir .tmp
mv infra/signal .tmp/signaling

scp -i ~/.ssh/LightsailDefaultKey-eu-west-3.pem -r .tmp/signaling ec2-user@rtc-static.tk:rtc/webrtc-working-examples/signaling

mv .tmp/signaling infra/signal
rmdir .tmp
