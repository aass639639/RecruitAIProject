from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models.user import User
from models import candidate, interview # Ensure all models are imported for metadata

def seed_users():
    db = SessionLocal()
    try:
        # Check if users already exist
        if db.query(User).count() > 0:
            print("Users already seeded.")
            return

        users = [
            User(username="admin", full_name="系统管理员", role="admin", department="HR"),
            User(username="tech_mgr", full_name="研发经理", role="interviewer", department="研发"),
            User(username="fin_mgr", full_name="财务经理", role="interviewer", department="财务"),
            User(username="alg_mgr", full_name="算法经理", role="interviewer", department="算法"),
        ]
        db.add_all(users)
        db.commit()
        print("Users seeded successfully.")
    except Exception as e:
        print(f"Error seeding users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    seed_users()
