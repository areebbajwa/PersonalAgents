import os
import argparse
from pypdf import PdfReader
import shutil

def convert_pdf_to_text(pdf_path, output_dir):
    """
    Converts a single PDF file to a text file.

    Args:
        pdf_path (str): The full path to the input PDF file.
        output_dir (str): The directory to save the output text file.
    """
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n\n--- Page Break ---\n\n"

        if not text.strip():
            print(f"Warning: No text extracted from {pdf_path}")
            return False

        base_name = os.path.basename(pdf_path)
        text_file_name = os.path.splitext(base_name)[0] + ".txt"
        output_text_path = os.path.join(output_dir, text_file_name)

        os.makedirs(output_dir, exist_ok=True)
        with open(output_text_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Successfully converted {pdf_path} to {output_text_path}")
        return True
    except Exception as e:
        print(f"Error converting {pdf_path}: {e}")
        return False

def batch_convert_pdfs(input_dir, output_dir):
    """
    Converts all PDF files in a given input directory to text files
    and saves them in the output directory.

    Args:
        input_dir (str): The directory containing PDF files.
        output_dir (str): The directory to save the output text files.
    """
    if not os.path.isdir(input_dir):
        print(f"Error: Input directory '{input_dir}' not found.")
        return

    if not os.path.isdir(output_dir):
        print(f"Output directory '{output_dir}' not found. Creating it.")
        os.makedirs(output_dir, exist_ok=True)

    print(f"Scanning '{input_dir}' for PDF files...")
    pdf_files_found = 0
    successful_conversions = 0

    for item in os.listdir(input_dir):
        if item.lower().endswith(".pdf"):
            pdf_files_found += 1
            full_pdf_path = os.path.join(input_dir, item)
            print(f"Found PDF: {full_pdf_path}")
            if convert_pdf_to_text(full_pdf_path, output_dir):
                successful_conversions +=1
    
    print(f"\nBatch conversion summary:")
    print(f"PDF files found: {pdf_files_found}")
    print(f"Successful conversions: {successful_conversions}")
    print(f"Failed conversions: {pdf_files_found - successful_conversions}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert PDF files in a directory to text files.")
    parser.add_argument("input_dir", help="Directory containing the PDF files to convert (e.g., ~/Downloads).")
    parser.add_argument("output_dir", nargs='?', default="finances/financial-reports/data/extracted_statements/",
                        help="Directory to save the extracted text files. Defaults to 'finances/financial-reports/data/extracted_statements/'.")

    args = parser.parse_args()

    # Expand user for input_dir, e.g., ~ to /Users/username
    input_directory = os.path.expanduser(args.input_dir)
    output_directory = os.path.expanduser(args.output_dir) # Also expand user for output if specified with ~

    batch_convert_pdfs(input_directory, output_directory) 