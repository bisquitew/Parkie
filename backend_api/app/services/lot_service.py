def get_status_color(capacity: int, available_spots: int) -> str:
    """
    Calculates the marker color based on occupancy percentage:
    - Below 70% occupied: green
    - Between 70% and 85% occupied: yellow
    - Above 85% occupied: red
    """
    if capacity <= 0:
        return "gray"
    
    occupied = capacity - available_spots
    occupancy_rate = (occupied / capacity) * 100
    
    if occupancy_rate < 70:
        return "green"
    elif occupancy_rate <= 85:
        return "yellow"
    else:
        return "red"
