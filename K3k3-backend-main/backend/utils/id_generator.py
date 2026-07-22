import random

def generate_id(prefix: str) -> str:
    """Generate a unique ID with the given prefix.
    
    Args:
        prefix: String prefix for the ID (e.g., 'K3R' for rider IDs)
    
    Returns:
        A unique ID string in the format: {prefix}-{6-digit-number}
    """
    num = str(random.randint(0, 999999)).zfill(6)
    return f"{prefix}-{num}"


if __name__ == '__main__':
    rider_id = generate_id("K3R")
    print(rider_id)
