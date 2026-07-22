import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.main import KnowledgeRequest, public_document, team_document, team_documents, update_document


class DocumentApiTests(unittest.TestCase):
    @patch("app.main.fetch_all", return_value=[{"id": 3, "title": "Runbook"}])
    def test_team_list_is_scoped_to_project(self, fetch_all):
        self.assertEqual(team_documents("Atlas", {})[0]["id"], 3)
        self.assertEqual(fetch_all.call_args.args[1], ("Atlas",))

    @patch("app.main.fetch_one", return_value=None)
    def test_public_document_hides_missing_or_internal_page(self, _fetch_one):
        with self.assertRaises(HTTPException) as error:
            public_document("Atlas", 99)
        self.assertEqual(error.exception.status_code, 404)

    @patch("app.main.fetch_one", return_value={"id": 3, "title": "Updated"})
    def test_update_persists_page_by_id(self, fetch_one):
        request = KnowledgeRequest(
            project="Atlas",
            title="Updated",
            content="Real page content",
            kind="guide",
            visibility="public",
        )
        self.assertEqual(update_document(3, request, {})["title"], "Updated")
        self.assertEqual(fetch_one.call_args.args[1][-1], 3)

    @patch("app.main.fetch_one", return_value=None)
    def test_team_document_returns_404(self, _fetch_one):
        with self.assertRaises(HTTPException):
            team_document(99, {})


if __name__ == "__main__":
    unittest.main()
