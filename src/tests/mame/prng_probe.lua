-- MAME probe: DP $84/$85/$86 after each call of the ROM's prng_update
-- ($D6CD), from power-on. Output format matches src/tests/fixtures/prng_golden.txt.
--
--   PROBE_OUT=out.txt PROBE_COUNT=1000 mame robotron -autoboot_script prng_probe.lua ...
--
-- The routine ends STB <$84 at $D6E6, after both RORs, so a write tap on
-- $9884 (direct page $98) filtered to the routine's PCs sees each new state.

local out_path = os.getenv("PROBE_OUT") or "prng_probe.txt"
local limit = tonumber(os.getenv("PROBE_COUNT") or "1000")

local out = assert(io.open(out_path, "w"))
local count = 0

-- -autoboot_script runs after the machine has reset, so install right away.
-- Kept in a global: MAME removes a tap once its handle is garbage-collected.
do
    local cpu = manager.machine.devices[":maincpu"]
    local space = cpu.spaces["program"]
    _G.prng_probe_tap = space:install_write_tap(0x9884, 0x9884, "prng_probe", function(offset, data, mask)
        if count >= limit then return end
        local pc = cpu.state["PC"].value
        if pc < 0xD6CD or pc > 0xD6EC then return end
        out:write(string.format("%02X %02X %02X\n", data & 0xFF, space:read_u8(0x9885), space:read_u8(0x9886)))
        count = count + 1
        if count == limit then
            out:close()
            manager.machine:exit()
        end
    end)
end
