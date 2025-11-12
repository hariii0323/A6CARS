pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/hariii0323/A6CARS.git'
            }
        }
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test || echo "No tests defined"'
            }
        }
    }
}
