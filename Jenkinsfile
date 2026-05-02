pipeline {
    agent {
        docker {
            image 'python:3.11-slim'
            args '-u root:root'
        }
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                python -m pip install --upgrade pip
                pip install -r backend/requirements.txt
                '''
            }
        }
        
        stage('Run Tests') {
            steps {
                dir('backend') {
                    sh 'pytest -q'
                }
            }
        }
    }
    
    post {
        always {
            echo "CI pipeline completed."
        }
        success {
            echo "All tests passed successfully!"
        }
        failure {
            echo "Tests failed. Please check the logs."
        }
    }
}
