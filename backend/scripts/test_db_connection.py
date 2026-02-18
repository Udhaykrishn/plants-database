import psycopg2
from psycopg2 import OperationalError

def create_connection():
    connection = None
    try:
        connection = psycopg2.connect(
            database="postgres",
            user="postgres",
            password="password",
            host="localhost",
            port="5432",
        )
        print("Connection to PostgreSQL DB successful")
    except OperationalError as e:
        print(f"The error '{e}' occurred")
        try:
            # Try with 'postgres' password
            connection = psycopg2.connect(
                database="postgres",
                user="postgres",
                password="postgres",
                host="localhost",
                port="5432",
            )
            print("Connection to PostgreSQL DB successful with password 'postgres'")
        except OperationalError as e2:
             print(f"The error '{e2}' occurred with password 'postgres'")
             # Try without password (peer/trust)
             try:
                connection = psycopg2.connect(
                    database="postgres",
                    user="postgres",
                    host="localhost",
                    port="5432",
                )
                print("Connection to PostgreSQL DB successful without password")
             except OperationalError as e3:
                print(f"The error '{e3}' occurred without password")

    return connection

if __name__ == "__main__":
    create_connection()
