import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StatusBar,
    Alert,
    Image,
    Dimensions,
    ScrollView,
    TextInput,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PalletItem {
    id: string;
    fxh: string;
    palletCode: string;
    qty: string;
    model: string;
    color: string;
}


interface PalletRowProps {
    item: PalletItem;
    index: number;
    isSelected: boolean;
    onPress: (index: number) => void;
}

const PalletRow = React.memo(({ item, index, isSelected, onPress }: PalletRowProps) => (
    <TouchableOpacity
        style={[
            styles.tableRow,
            { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
            isSelected && styles.selectedRow,
        ]}
        onPress={() => onPress(index)}
        activeOpacity={0.7}
    >
        <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
        <Text style={[styles.cell, { width: 150 }]}>{item.palletCode}</Text>
        <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
    </TouchableOpacity>
));
// ─────────────────────────────────────────────────────────────────────────────

export default function PalletNotIn({ navigation }: any) {
    const global = useGlobal();
    const {
        gsURL,
        gs_factoryCode,
        gs_userName,
        operateUserCode,
        operateUserName,
        operateWareHouseCode,
        operateRandomNumber,
        operateSign,
        operateVersion,
    } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [pallets, setPallets] = useState<PalletItem[]>([]);
    const [totalQty, setTotalQty] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // ── Load token ────────────────────────────────────────────────────────────
    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN PalletNotIn", t);
            if (t) setToken(t);
        };
        loadToken();
    }, []);

    // ── Fetch pallets ─────────────────────────────────────────────────────────
    const fetchPallets = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/PalletNotIn`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    operateUserCode,
                    operateUserName,
                    operateWareHouseCode,
                    operateRandomNumber,
                    operateSign,
                    operateVersion,
                    factoryCode: gs_factoryCode,
                }),
            });

            if (response.status === 401) {
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (response.status === 403) {
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }

            const result = await response.json();

            if (result.code === 500) {
                Alert.alert("Error", result.message);
                navigation.goBack();
                return;
            }

            if (result.message === "success" && result.data && result.data.length > 0) {
                let total = 0;
                const mapped: PalletItem[] = result.data.map((item: any, index: number) => {
                    total += parseInt(item.qty || "0");
                    return {
                        id: index.toString(),
                        fxh: item.fxh,
                        palletCode: item.palletCode,
                        qty: item.qty,
                        model: item.model,
                        color: item.color,
                    };
                });
                setPallets(mapped);
                setTotalQty(total);
            } else {
                setPallets([]);
                setTotalQty(0);
                Alert.alert("Notice", "There is no product in the Pallet!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    }, [gs_factoryCode, BASE_URL, token]);

    useEffect(() => {
        if (token) fetchPallets();
    }, [fetchPallets, token]);

    // ── Stable callbacks ──────────────────────────────────────────────────────
    const handleSelectItem = useCallback((index: number) => {
        setSelectedItemIndex(index);
    }, []);

    const handleBarcodeDetails = useCallback(() => {
        if (selectedItemIndex !== null) {
            navigation.navigate("PalletNotInBox", {
                palletCode: pallets[selectedItemIndex].palletCode,
            });
        } else {
            Alert.alert("Notice", "Please select a pallet first.");
        }
    }, [selectedItemIndex, pallets, navigation]);

    // ── renderItem memoized — only re-runs when selectedItemIndex changes ──────
    const renderItem = useCallback(
        ({ item, index }: { item: PalletItem; index: number }) => (
            <PalletRow
                item={item}
                index={index}
                isSelected={selectedItemIndex === index}
                onPress={handleSelectItem}
            />
        ),
        [selectedItemIndex, handleSelectItem]
    );

    const keyExtractor = useCallback((item: PalletItem) => item.id, []);

    const filteredPallets = pallets.filter(item =>
        item.palletCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.color.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTotalQty = filteredPallets.reduce((acc, curr) => acc + parseInt(curr.qty || "0"), 0);
    const filteredPalletCount = filteredPallets.length;

    // ── UI ────────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Pallets Not In</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsCard}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total QTY</Text>
                    <Text style={styles.statValue}>{filteredTotalQty}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Pallets</Text>
                    <Text style={styles.statValue}>{filteredPalletCount}</Text>
                </View>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search Pallet, Model or Color..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                />
            </View>

            {/* Table */}
            <View style={styles.content}>
                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Pallet Code</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                            </View>

                            {loading ? (
                                <ActivityIndicator
                                    size="large"
                                    color="#0052cc"
                                    style={{ marginTop: 40 }}
                                />
                            ) : (
                                <FlatList
                                    data={filteredPallets}
                                    renderItem={renderItem}
                                    keyExtractor={keyExtractor}
                                    extraData={selectedItemIndex}  
                                    contentContainerStyle={{ paddingBottom: 20 }}
                                    onRefresh={fetchPallets}
                                    refreshing={loading}
                                    scrollEnabled={true}
                                    removeClippedSubviews={true}   
                                    maxToRenderPerBatch={20}
                                    windowSize={10}
                                />
                            )}
                        </View>
                    </ScrollView>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.actionBtn,
                            styles.btnPrimary,
                            selectedItemIndex === null && styles.btnDisabled,
                        ]}
                        onPress={handleBarcodeDetails}
                        disabled={selectedItemIndex === null}
                    >
                        <Text style={styles.btnTextPrimary}>Barcode Details</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const { width } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        backgroundColor: "#0052cc",
        paddingHorizontal: width * 0.05,
        height: scale(56),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 4,
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: {
        color: "#FFFFFF",
        fontSize: isSmallDevice ? scale(14) : scale(16),
        fontWeight: "900",
    },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700", marginRight: 1 },
    statsCard: { padding: 16, paddingBottom: 8, flexDirection: "column", gap: 10 },
    searchContainer: { paddingHorizontal: 16, marginBottom: 12 },
    searchInput: {
        backgroundColor: "#FFFFFF",
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 14,
        color: "#1E293B",
        borderWidth: 1,
        borderColor: "#0052cc",
        elevation: 2,
        maxHeight:40
        
    },
    statBox: {
        
        backgroundColor: "#0052cc",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    content: { flex: 1 },
    tableCard: {
        flex: 1,
        backgroundColor: "#FFF",
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: "hidden",
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: -1,
    },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: {
        fontSize: 12,
        fontWeight: "800",
        color: "#FFFFFF",
        textAlign: "center",
        textTransform: "uppercase",
    },
    tableRow: {
        flexDirection: "row",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        alignItems: "center",
    },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    btnPrimary: { backgroundColor: "#0052cc" },
    btnDisabled: { backgroundColor: "#0052cc" },
    btnTextPrimary: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});