#!/bin/bash

mkdir .tmp
mv app .tmp/html

scp -i ~/.ssh/LightsailDefaultKey-eu-west-3.pem -r .tmp/html ec2-user@rtc-static.tk:rtc/host-app/data

mv .tmp/html app
rmdir .tmp
