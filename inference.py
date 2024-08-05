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

class FileNumberGenerator:
    def __init__(self):
        self.lock = threading.Lock()
        self.number = 0

    def get_next_number(self, directory):
        with self.lock:
            if self.number == 0:
                # Initialize with the highest existing number
                wav_files = [f for f in os.listdir(directory) if f.endswith('.wav')]
                numbers = [int(re.search(r'\d+', f).group()) for f in wav_files if re.search(r'\d+', f)]
                self.number = max(numbers or [0])
            self.number += 1
            return self.number

file_number_generator = FileNumberGenerator()

def download_audio_file(url, directory):
    try:
        os.makedirs(directory, exist_ok=True)
        next_number = file_number_generator.get_next_number(directory)
        output_path = os.path.join(directory, f"{next_number}.wav")

        response = requests.get(url, stream=True)
        response.raise_for_status()

        with open(output_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=8192):
                file.write(chunk)

        print(f"File downloaded successfully: {output_path}")
        return output_path
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
        downloaded_file = download_audio_file(audio_url, genre_directory)
        
        if downloaded_file:
            print(f"Audio file for {genre} downloaded to: {downloaded_file}")
        else:
            print(f"Failed to download the audio file for {genre}.")
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