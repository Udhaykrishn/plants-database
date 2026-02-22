from enum import Enum

class Rank(str, Enum):
    KINGDOM = "Kingdom"
    DIVISION = "Division"
    CLASS = "Class"
    ORDER = "Order"
    FAMILY = "Family"
    GENUS = "Genus"
    SPECIES = "Species"

class PlantingPlace(str, Enum):
    INDOOR = "Indoor"
    OUTDOOR = "Outdoor"
    BOTH = "Indoor & Outdoor"

