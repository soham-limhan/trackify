import traceback
from auth import register, UserCreate
from database import get_db

def test():
    db = get_db()
    user = UserCreate(email='test_err4@example.com', password='password', full_name='Test User')
    try:
        register(user, db)
        print('Success')
    except Exception as e:
        traceback.print_exc()

if __name__ == '__main__':
    test()
