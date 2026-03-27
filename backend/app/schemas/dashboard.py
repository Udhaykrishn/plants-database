from pydantic import BaseModel

class DashboardStats(BaseModel):
    total_plants: int
    total_taxonomy_nodes: int
    total_categories: int
    total_projects: int
