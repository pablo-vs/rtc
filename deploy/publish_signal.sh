#!/bin/bash

mkdir .tmp
mv infra/signal .tmp/signaling

scp -i ~/.ssh/LightsailDefaultKey-eu-west-3.pem -r .tmp/signaling ec2-user@rtc-static.tk:rtc/webrtc-working-example

ssh -i ~/.ssh/LightsailDefaultKey-eu-west-3.pem ec2-user@rtc-static.tk "cd rtc/webrtc-working-example/signaling ; docker container stop python_signaling; docker container rm python_signaling; sudo docker build . -t python_signaling; docker run --name python_signaling -d -p 9999:9999 python_signaling"

mv .tmp/signaling infra/signal
rmdir .tmp
