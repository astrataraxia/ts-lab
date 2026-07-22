-- Studio/01 ORD Advisor
--
-- TMO.GG desktop-release의 공개 Lua API를 사용하는 보조 스크립트입니다.
-- 기본 TMO.GG 조합도우미 스크립트와 함께 실행하면 현재 플레이어의
-- 유닛 수와 자원도 /datas 응답에 포함할 수 있습니다.

local function collectPlayerUnits(playerId)
  local counts = {}
  local handles = war3.getUnitHandle()

  if not handles then
    return counts
  end

  for _, realHandle in ipairs(handles) do
    local unit = war3.getUnit(realHandle)

    if unit and unit.owner == playerId then
      local unitId = unit.typeId:reverse()
      counts[unitId] = (counts[unitId] or 0) + 1
    end
  end

  return counts
end

callbacks.bind("OnResponse", function()
  local playerId = war3.getLocalPlayer()

  if not war3.hasWorld() then
    return
  end

  local units = collectPlayerUnits(playerId)

  for unitId, count in pairs(units) do
    setCustomResponse(unitId, count)
  end

  setCustomResponse(
    "GOLD",
    war3.getPlayerState(playerId, PLAYER_STATE_RESOURCE_GOLD)
  )
  setCustomResponse(
    "LUMBER",
    war3.getPlayerState(playerId, PLAYER_STATE_RESOURCE_LUMBER)
  )
end)
