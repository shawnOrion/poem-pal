import json
import csv
csv_file = 'PoetryFoundationData.csv'


def convert_csv_to_json(csv_filepath):
    with open(csv_filepath, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        json_data = []

        for i, row in enumerate(csv_reader, start=1):
            # Handle empty tags
            if 'Tags' not in row or row['Tags'].strip() == '':
                row['Tags'] = None

            # Assign new ID
            row['ID'] = i
            # strip new line and whitespace from title
            row['Title'] = row['Title'].strip()
            # remove double new line at start
            row['Poem'] = row['Poem'].strip()
            json_data.append(row)

    return json_data


json_output = convert_csv_to_json(csv_file)

# Write to JSON file
with open('PoetryData.json', 'w', encoding='utf-8') as f:
    json.dump(json_output, f, ensure_ascii=False, indent=4)

print("CSV converted to JSON successfully.")
