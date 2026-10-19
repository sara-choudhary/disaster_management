import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app import main as main_module
from app.main import app
from app import models as _app_models  # Register all models on Base.metadata
from app.services.seed_data import seed_database_idempotent
from app.services.simulation import seed_default_nodes_if_empty

# Isolated in-memory SQLite database for test runs
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Point main app engine and session to test_engine during tests
main_module.engine = test_engine
main_module.SessionLocal = TestingSessionLocal


@pytest.fixture(scope="session", autouse=True)
def init_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database_idempotent(db)
    seed_default_nodes_if_empty(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
