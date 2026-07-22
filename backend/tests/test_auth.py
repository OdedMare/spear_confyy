import unittest

from fastapi import HTTPException

from app.auth import create_session, read_session


class AuthTests(unittest.TestCase):
    def test_round_trip_and_rejects_tampering(self):
        token = create_session("team", "fde")
        self.assertEqual(read_session(token)["role"], "fde")
        with self.assertRaises(HTTPException):
            read_session(token[:-2] + "xx")


if __name__ == "__main__":
    unittest.main()

