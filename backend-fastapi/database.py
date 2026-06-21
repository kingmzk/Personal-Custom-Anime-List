from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# Assuming local SQL Express with Windows Authentication
SQLALCHEMY_DATABASE_URL = "mssql+pyodbc://@localhost\\SQLEXPRESS/AniemListDb?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    fast_executemany=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
