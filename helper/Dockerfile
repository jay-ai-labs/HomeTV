# HomeTV home helper for a NAS or any Docker host (e.g. Synology Container Manager)
FROM python:3.12-slim
WORKDIR /app
COPY server.py ./
COPY web ./web
ENV HOMETV_PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
VOLUME ["/app/data"]
CMD ["python", "server.py"]
