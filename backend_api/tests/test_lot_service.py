from app.services.lot_service import get_status_color

def test_get_status_color_green():
    assert get_status_color(100, 50) == "green"  # 50% occupied

def test_get_status_color_yellow():
    assert get_status_color(100, 20) == "yellow" # 80% occupied

def test_get_status_color_red():
    assert get_status_color(100, 10) == "red"    # 90% occupied

def test_get_status_color_gray():
    assert get_status_color(0, 0) == "gray"

def test_get_status_color_full():
    assert get_status_color(100, 0) == "red"   # 100% occupied

def test_get_status_color_empty():
    assert get_status_color(100, 100) == "green"  # 0% occupied

def test_get_status_color_boundary_yellow():
    assert get_status_color(100, 15) == "yellow"  # exactly 85% occupied

def test_get_status_color_boundary_red():
    assert get_status_color(100, 14) == "red"     # just over 85%
