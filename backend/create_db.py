import pyodbc

# Connection string without Database to connect to master and create the DB
conn_str = 'Driver={ODBC Driver 17 for SQL Server};Server=localhost\\SQLEXPRESS;Trusted_Connection=Yes;TrustServerCertificate=Yes;'

try:
    print("Connecting to SQL Server to create database...")
    # autocommit must be True to execute CREATE DATABASE
    conn = pyodbc.connect(conn_str, autocommit=True)
    cursor = conn.cursor()
    
    # Check if database exists
    cursor.execute("SELECT name FROM master.dbo.sysdatabases WHERE name = N'AniemListDb'")
    if not cursor.fetchone():
        print("Database 'AniemListDb' does not exist. Creating...")
        cursor.execute("CREATE DATABASE [AniemListDb]")
        print("Database created successfully.")
    else:
        print("Database 'AniemListDb' already exists.")
        
    cursor.close()
    conn.close()
except pyodbc.Error as e:
    print(f"Database creation failed: {e}")
