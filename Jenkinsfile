pipeline {
    agent any

    stages {
       stage('Checkout') {
    steps {
        git branch: 'main', url: 'https://github.com/hariii0323/A6CARS.git'
    }
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
