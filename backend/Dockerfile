FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd -u 10001 -m brain
COPY main.py .
# The VPS deployment checks out sources with umask 077, potentially making
# copied Python files mode 600. Explicitly grant read access to uid 10001.
RUN chmod 0755 /app && chmod 0644 /app/main.py \
    && mkdir -p /data && chown brain:brain /data
USER brain
EXPOSE 8787
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "1", "--no-proxy-headers"]
