import pytest

from app.modules.github.service import parse_repo_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://github.com/pallets/flask", ("pallets", "flask")),
        ("github.com/Pallets/Flask.git", ("pallets", "flask")),
        ("https://github.com/fastapi/fastapi/tree/master/docs", ("fastapi", "fastapi")),
        ("https://www.github.com/a-b/c.d_e?tab=readme", ("a-b", "c.d_e")),
        ("  owner/repo  ", ("owner", "repo")),
    ],
)
def test_parse_valid(raw, expected):
    assert parse_repo_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "https://gitlab.com/a/b",
        "https://github.com/onlyowner",
        "http://169.254.169.254/latest/meta-data",
        "https://github.com.evil.com/a/b",
        "https://github.com/../etc",
        "javascript:alert(1)",
        "ftp://github.com/a/b",
    ],
)
def test_parse_rejects(raw):
    with pytest.raises(ValueError):
        parse_repo_url(raw)
