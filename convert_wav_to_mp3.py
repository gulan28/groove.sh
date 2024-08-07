import os
import concurrent.futures
from pydub import AudioSegment
import argparse

def convert_wav_to_mp3(wav_path, mp3_path):
    try:
        audio = AudioSegment.from_wav(wav_path)
        audio.export(mp3_path, format="mp3")
        print(f"Converted: {wav_path} -> {mp3_path}")
        return True
    except Exception as e:
        print(f"Error converting {wav_path}: {e}")
        return False

def process_folder(folder_path):
    wav_files = [f for f in os.listdir(folder_path) if f.endswith('.wav')]
    converted = 0
    failed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_file = {executor.submit(convert_wav_to_mp3, 
                                          os.path.join(folder_path, wav_file),
                                          os.path.join(folder_path, wav_file.rsplit('.', 1)[0] + '.mp3')): wav_file 
                          for wav_file in wav_files}
        
        for future in concurrent.futures.as_completed(future_to_file):
            if future.result():
                converted += 1
            else:
                failed += 1

    return converted, failed

def main(base_folder):
    total_converted = 0
    total_failed = 0

    for root, dirs, files in os.walk(base_folder):
        if any(file.endswith('.wav') for file in files):
            print(f"\nProcessing folder: {root}")
            converted, failed = process_folder(root)
            total_converted += converted
            total_failed += failed
            print(f"Converted: {converted}, Failed: {failed}")

    print(f"\nTotal converted: {total_converted}")
    print(f"Total failed: {total_failed}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert WAV files to MP3 in subgenre folders")
    parser.add_argument("base_folder", help="Path to the base folder containing subgenre folders")
    args = parser.parse_args()

    main(args.base_folder)