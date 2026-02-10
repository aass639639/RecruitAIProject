import sqlite3
import os

db_path = 'recruit_ai.db'

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 检查 category 是否已经存在
        cursor.execute("PRAGMA table_info(job_descriptions)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'category' not in columns:
            print("Adding category column to job_descriptions table...")
            cursor.execute("ALTER TABLE job_descriptions ADD COLUMN category TEXT DEFAULT '其他'")
            conn.commit()
            print("Successfully added category column.")
        else:
            print("category column already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Error fixing database: {e}")
else:
    print(f"Database file {db_path} not found.")
