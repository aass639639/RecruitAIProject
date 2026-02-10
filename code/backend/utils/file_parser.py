import fitz  # PyMuPDF
from docx import Document
import io
import logging

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_content: bytes) -> str:
    """从 PDF 字节内容中提取文本"""
    try:
        text = ""
        with fitz.open(stream=file_content, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text()
        return text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        raise Exception(f"无法从 PDF 中提取文本: {str(e)}")

def extract_text_from_docx(file_content: bytes) -> str:
    """从 Docx 字节内容中提取文本"""
    try:
        doc = Document(io.BytesIO(file_content))
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])
    except Exception as e:
        logger.error(f"Error extracting text from Docx: {str(e)}")
        raise Exception(f"无法从 Docx 中提取文本: {str(e)}")

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """根据文件扩展名提取文本"""
    extension = filename.split(".")[-1].lower()
    if extension == "pdf":
        return extract_text_from_pdf(file_content)
    elif extension in ["doc", "docx"]:
        return extract_text_from_docx(file_content)
    elif extension == "txt":
        return file_content.decode("utf-8")
    else:
        raise ValueError(f"不支持的文件格式: {extension}")
