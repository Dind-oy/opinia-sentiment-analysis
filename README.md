# opinia-sentiment-analysis
# Opinia
### Web-Based Sentiment Analysis of Mobile Legends: Bang Bang Reviews Using Random Forest

**Opinia** is a web-based sentiment analysis application designed to classify user reviews of the Mobile Legends: Bang Bang application into sentiment categories using the Random Forest algorithm.

## Features

- **Sentiment Classification:** Classify user reviews into sentiment categories.
- **Manual Prediction:** Enter a review and predict its sentiment.
- **Dataset Upload:** Upload review datasets for analysis.
- **Data Visualization:** Display sentiment analysis results through visualizations.
- **Analysis History:** View previously processed analysis results.
- **Reports:** Access and manage sentiment analysis reports.

## Technologies Used

| Category | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | PHP |
| Machine Learning API | Python, FastAPI |
| Machine Learning Algorithm | Random Forest |
| Feature Extraction | TF-IDF |
| Database | MySQL |
| Development Environment | XAMPP, Visual Studio Code |

## Machine Learning Workflow

1. Collect user reviews of Mobile Legends: Bang Bang.
2. Preprocess the review text.
3. Transform text data using TF-IDF.
4. Classify sentiment using the Random Forest model.
5. Display classification results through the web application.

## Project Structure

```text
opinia-sentiment-analysis/
├── backend/
├── css/
├── github/
├── js/
├── python/
│   ├── model/
│   │   ├── model.pkl
│   │   └── tfidf_vectorizer.pkl
│   └── app.py
├── index.html
├── koneksi.php
└── requirements.txt
```

## Local Development

This project was developed and tested in a local development environment using XAMPP and Python.

The PHP backend requires a MySQL database, while the machine learning API uses FastAPI.

## Project Status

Source code is available in this repository. Deployment and production configuration are separate from the local development setup.

## Author

**Adinda Fina**

GitHub: [@Dind-oy](https://github.com/Dind-oy)
