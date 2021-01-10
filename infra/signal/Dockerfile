FROM python:3.8-buster

# Set up signaling server at localhost:9999

RUN mkdir /signaling
COPY ./ /signaling

RUN pip install -r /signaling/requirements.txt

EXPOSE 9999

CMD ["python", "-u", "/signaling/server.py"]
