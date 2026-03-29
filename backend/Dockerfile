FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    tesseract-ocr \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv

COPY requirements.txt .
RUN /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

RUN /opt/venv/bin/python - <<'PYEOF'
from docling.document_converter import DocumentConverter
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.base_models import InputFormat
from docling.document_converter import PdfFormatOption

opts = PdfPipelineOptions()
opts.do_ocr = False
opts.do_table_structure = True
DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})
print("Docling models cached successfully.")
PYEOF

COPY . .
RUN mkdir -p /app/docs

EXPOSE 8080

CMD ["/opt/venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--reload"]