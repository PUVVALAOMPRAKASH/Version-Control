# Version Control Platform

A full-stack GitHub-inspired repository management platform enabling collaborative development with advanced features.

## Features

- Create, upload, and download files within repositories.  
- Search repository contents and view README files.  
- Manage repository visibility with public and private access and the visibility can be changed by author accordingly at any moment.
- Role-Based Access Control (RBAC) with Manager, Developer, and Client roles for secure permission management.  
- Rollback functionality for file version control and secure repository sharing.  
- Responsive UI built with React and Bootstrap for seamless navigation.

## Tech Stack

## Tech Stack

- **Frontend:** React with Bootstrap for a responsive and intuitive user interface.  
- **Backend:** Node.js and Express.js to build a robust and scalable RESTful API.  
- **Database:** MongoDB for primary data storage, complemented by Firebase for real-time synchronization and repository metadata management.  
- **Authentication & Authorization:** Custom Role-Based Access Control (RBAC) system ensuring secure and granular permission management across Manager, Developer, and Client roles.


## Installation

1. Clone the repo:

   ```bash
   git clone https://github.com/YourUsername/Version-Control.git
2.Install dependencies:

   ```bash
   cd Version-Control
   npm install
  ```

 Set up environment variables (e.g., database URI, JWT secret).

3.Run the backend server:

```bash
npm start
Run the frontend:
```
```bash
cd client
npm start
```
Usage
Register and login to create and manage repositories.

Upload files and control repository visibility.

Collaborate with team members with defined roles and permissions.

Use rollback to manage file versions securely.

License
This project is licensed under the MIT License.

