import requests
import os
import re
import json
import random
import argparse
from dotenv import load_dotenv
import fal_client
import threading
import concurrent.futures
from pydub import AudioSegment

class FileNumberGenerator:
    def __init__(self):
        self.lock = threading.Lock()
        self.number = 0

    def get_next_number(self, directory):
        with self.lock:
            if self.number == 0:
                # Initialize with the highest existing number
                mp3_files = [f for f in os.listdir(directory) if f.endswith('.mp3')]
                numbers = [int(re.search(r'\d+', f).group()) for f in mp3_files if re.search(r'\d+', f)]
                self.number = max(numbers or [0])
            self.number += 1
            return self.number

file_number_generator = FileNumberGenerator()

def convert_wav_to_mp3(wav_path, mp3_path):
    try:
        audio = AudioSegment.from_wav(wav_path)
        audio.export(mp3_path, format="mp3")
        print(f"Converted {wav_path} to {mp3_path}")
        os.remove(wav_path)  # Remove the original WAV file
    except Exception as e:
        print(f"Error converting WAV to MP3: {e}")

def download_and_convert_audio_file(url, directory):
    try:
        os.makedirs(directory, exist_ok=True)
        next_number = file_number_generator.get_next_number(directory)
        wav_path = os.path.join(directory, f"{next_number}.wav")
        mp3_path = os.path.join(directory, f"{next_number}.mp3")

        response = requests.get(url, stream=True)
        response.raise_for_status()

        with open(wav_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=8192):
                file.write(chunk)

        print(f"File downloaded successfully: {wav_path}")
        
        # Convert WAV to MP3
        convert_wav_to_mp3(wav_path, mp3_path)
        
        return mp3_path
    except requests.RequestException as e:
        print(f"Error downloading file: {e}")
        return None

def generate_and_download_song(genre, prompt, base_directory="music"):
    try:
        handler = fal_client.submit(
            "fal-ai/stable-audio",
            arguments={
                "prompt": prompt,
                "seconds_total": 47,
            },
        )

        result = handler.get()
        audio_url = result['audio_file']['url']
        
        genre_directory = os.path.join(base_directory, genre)
        downloaded_file = download_and_convert_audio_file(audio_url, genre_directory)
        
        if downloaded_file:
            print(f"Audio file for {genre} downloaded and converted to: {downloaded_file}")
        else:
            print(f"Failed to download and convert the audio file for {genre}.")
    except Exception as e:
        print(f"Error generating song for {genre}: {e}")

def main(genre, num_songs, prompts_file):
    load_dotenv()

    with open(prompts_file, 'r') as f:
        prompts = json.load(f)

    if genre not in prompts:
        print(f"Error: Genre '{genre}' not found in the prompts file.")
        return

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = []
        for _ in range(num_songs):
            prompt = random.choice(prompts[genre])
            futures.append(executor.submit(generate_and_download_song, genre, prompt))

        concurrent.futures.wait(futures)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and download genre-based music")
    parser.add_argument("genre", help="Genre of music to generate")
    parser.add_argument("num_songs", type=int, help="Number of songs to generate")
    parser.add_argument("--prompts", default="prompts.json", help="JSON file containing prompts")
    
    args = parser.parse_args()

    main(args.genre, args.num_songs, args.prompts)