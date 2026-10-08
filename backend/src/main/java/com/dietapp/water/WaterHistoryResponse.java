package com.dietapp.water;

import java.util.List;

public record WaterHistoryResponse(String month, List<WaterHistoryDayResponse> days) {
}
