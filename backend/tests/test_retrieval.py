import unittest

from app.retrieval import retrieve_documents, sanitize_public_question


class RetrievalTests(unittest.TestCase):
    def test_finds_matching_document(self):
        documents = [
            {"title": "התראות", "content": "מגדירים ערוץ מסירה"},
            {"title": "דוחות", "content": "מייצאים קובץ CSV"},
        ]
        result = retrieve_documents("איך מגדירים התראה וערוץ?", documents)
        self.assertEqual(result[0]["title"], "התראות")

    def test_redacts_token_from_public_question(self):
        value = sanitize_public_question("ה-token=super-secret לא עובד")
        self.assertNotIn("super-secret", value)
        self.assertIn("[הוסר]", value)


if __name__ == "__main__":
    unittest.main()

