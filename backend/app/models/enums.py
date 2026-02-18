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
    BOTH = "Both"

class PlantCategory(str, Enum):
    TREE = "Tree"
    SHRUB = "Shrub"
    PALM = "Palm"
    CREEPER = "Creeper"
    GROUNDCOVER = "Groundcover"
    CLIMBER = "Climber"
    FERN = "Fern"
    GRASS = "Grass"
    SUCCULENT = "Succulent"
    AQUATIC = "Aquatic"
    OTHER = "Other"
