# S-Curve Energy Model Visualization

This project implements an energy model based on the S-curve methodology described in `Methodology.docx`. It uses CSV files for input data and visualizes the results using HTML, CSS, and JavaScript with a charting library.

## Project Structure

* `/`: Root directory
    * `index.html`: Main HTML file
    * `README.md`: This file
    * `.gitignore`: Git ignore file
* `/css`: Contains stylesheets
    * `style.css`: Main styles
* `/js`: Contains JavaScript files
    * `main.js`: Main application script, orchestrates loading and execution
    * `dataLoader.js`: Fetches and parses CSV data
    * `modelLogic.js`: Core energy model calculation logic
    * `uiController.js`: Handles user interface elements and interactions
    * `charting.js`: Creates and updates charts (requires a charting library like Chart.js)
    * `/lib`: (Optional) For third-party libraries like PapaParse or Chart.js
* `/data`: Contains input data CSV files (structure based on `SEM dataset - *.csv` files)

## Setup

Run the setup script once to install dependencies locally and copy required libraries into `js/lib`:

```bash
bash scripts/setup.sh
```

This only needs to be done before running tests or serving the project for the first time.

## Methodology

The core calculations follow the logic outlined in the `Methodology.docx` document[cite: 1], including:
* Calculating Demand Technology Activity
* Calculating Final Energy Consumption (FEC)
* Calculating Useful Energy (UE)
* Modeling energy transformations (Hydrogen, Power, Other)
* Calculating Primary Energy Demand (PED)

## How to Run

1.  Ensure all CSV data files are present in the `/data` directory.
2.  (Optional but recommended) Use a local web server to serve the files due to browser security restrictions (`Workspace` API for local files). A simple option is Python's `http.server`:
    ```bash
    python -m http.server
    ```
    Or using Node.js `http-server`:
    ```bash
    npm install -g http-server
    http-server .
    ```
3.  Open `index.html` in your web browser (preferably via the local server URL, e.g., `http://localhost:8000`).

## Dependencies

* (Recommended) [Chart.js](https://www.chartjs.org/) for visualization. Download and place in `/js/lib` or link via CDN in `index.html`.
* (Recommended) [PapaParse](https://www.papaparse.com/) for robust CSV parsing. Download and place in `/js/lib` or link via CDN.

## TODO

* Implement detailed calculation logic in `js/modelLogic.js` based on `Methodology.docx`[cite: 1].
* Implement data processing in `js/charting.js` to format results for charts.
* Add UI controls (sliders, dropdowns) in `index.html` and connect them in `js/uiController.js`.
* Refine CSV parsing in `js/dataLoader.js` (using PapaParse is recommended).
* Add error handling and user feedback.
* Extend CSV data or implement S-curve logic for years beyond 2023.
