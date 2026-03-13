package com.zenlocare.HMS_backend.dto;

import com.zenlocare.HMS_backend.entity.PriceListItem;
import lombok.Data;
import java.math.BigDecimal;
import java.util.UUID;

@Data
public class PriceListItemRequest {
    private UUID priceListId;
    private PriceListItem.ItemType itemType;
    private UUID itemId;
    private String itemName;
    private BigDecimal price;
    private Boolean isActive;
}
