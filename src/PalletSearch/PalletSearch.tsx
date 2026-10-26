import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    StatusBar,
    ActivityIndicator,
    Image,
    Dimensions,
    ScrollView,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as palletSearchClient from "./palletSearchClient";

interface BoxItem {
    id: string;
    scanBarCode: string;
    palletCode: string;
    model: string;
    color: string;
    imei1: string;
    imei2: string;
    imei3: string;
    scanBarCodeType: string;
    goodsCount: string;
    boxCode: string;
}

export default function PalletSearch({ navigation }: any) {
    const {
        gs_BaseURL,
        gs_wareCode,
        gs_userCode,
        gs_userName,
    gs_PasswordSalt,
        
    gs_version,
    gs_factoryindex,
} = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

    const [txtSN, setTxtSN] = useState("");
    const [items, setItems] = useState<BoxItem[]>([]);
    const [qtyTotal, setQtyTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showKeyboard, setShowKeyboard] = useState(false);

    const txtSNRef = useRef<TextInput>(null);
    const scanTimerRef = useRef<any>(null);

    useEffect(() => {
        const focusSub = navigation.addListener("focus", () => {
            setTimeout(() => {
                txtSNRef.current?.focus();
            }, 150);
        });

        return () => {
            focusSub();
        };
    }, [navigation]);

    const ensureFocus = () => {
        txtSNRef.current?.focus();
    };

    const handleSNSubmit = () => {
        if (scanTimerRef.current) {
            clearTimeout(scanTimerRef.current);
        }
        const SN = txtSN.toUpperCase().trim();
        if (SN.length > 0) {
            const scanType = pubfunction.getBarcodeType(SN);
            boxListShow(SN, scanType);
        }
    };

    const handleSNChange = (text: string) => {
        setTxtSN(text);

        if (scanTimerRef.current) {
            clearTimeout(scanTimerRef.current);
        }

        if (text.endsWith("\n") || text.endsWith("\r")) {
            const SN = text.replace(/[\r\n]/g, "").toUpperCase().trim();
            if (SN.length > 0) {
                const scanType = pubfunction.getBarcodeType(SN);
                boxListShow(SN, scanType);
            }
            return;
        }

        // Auto-submit after 500ms of inactivity for scanners that don't send Enter
        if (text.trim().length > 0) {
            scanTimerRef.current = setTimeout(() => {
                const SN = text.toUpperCase().trim();
                if (SN.length > 0) {
                    const scanType = pubfunction.getBarcodeType(SN);
                    boxListShow(SN, scanType);
                }
            }, 500);
        }
    };

    const boxListShow = async (barcode: string, scanType: string) => {
        setLoading(true);
        try {
            const res = await palletSearchClient.getScanBarCodeSumInfo(
                gs_BaseURL,
                gs_wareCode,
                barcode,
                scanType,
                gs_userCode,
                gs_userName,
                gs_PasswordSalt,
                gs_version
            );

            if (res && res.success && res.list) {
                let allQty = 0;
                const mappedItems: BoxItem[] = res.list.map((item: any, index: number) => {
                    allQty += parseInt(item.goodsCount || "0", 10);
                    return {
                        id: String(index),
                        scanBarCode: item.scanBarCode || "",
                        palletCode: item.palletCode || "",
                        model: item.model || "",
                        color: item.color || "",
                        imei1: item.imei1 || "",
                        imei2: item.imei2 || "",
                        imei3: item.imei3 || "",
                        scanBarCodeType: item.scanBarCodeType || "",
                        goodsCount: item.goodsCount || "",
                        boxCode: item.boxCode || "",
                    };
                });

                setItems(mappedItems);
                setQtyTotal(allQty);
            } else {
                pubfunction.ShowError(res.msg || "Error processing data.");
                setItems([]);
                setQtyTotal(0);
            }
        } catch (err: any) {
            pubfunction.ShowError("Network Error");
        } finally {
            setLoading(false);
            setTxtSN("");
            setTimeout(() => {
                txtSNRef.current?.focus();
            }, 150);
        }
    };

    const handleExitClick = () => {
        navigation.goBack();
    };

    const renderItem = ({ item, index }: { item: BoxItem; index: number }) => {
        return (
            <View
                style={[
                    styles.row,
                    { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
                ]}
            >
                <Text style={[styles.cell, { width: 180 }]}>{item.scanBarCode}</Text>
                <Text style={[styles.cell, { width: 180 }]}>{item.palletCode}</Text>
                <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
                <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                <Text style={[styles.cell, { width: 140 }]}>{item.imei1}</Text>
                <Text style={[styles.cell, { width: 140 }]}>{item.imei2}</Text>
                <Text style={[styles.cell, { width: 140 }]}>{item.imei3}</Text>
                <Text style={[styles.cell, { width: 80 }]}>{item.scanBarCodeType}</Text>
                <Text style={[styles.cell, { width: 80 }]}>{item.goodsCount}</Text>
                <Text style={[styles.cell, { width: 120 }]}>{item.boxCode}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleExitClick} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Pallet Search {gs_wareCode}</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.inputGroup}>
                    <TextInput
                        ref={txtSNRef}
                        style={styles.input}
                        value={txtSN}
                        onChangeText={handleSNChange}
                        onSubmitEditing={handleSNSubmit}
                        placeholder=" SCAN BARCODE"
                        placeholderTextColor="#64748B"
                        autoCapitalize="characters"
                        showSoftInputOnFocus={showKeyboard}
                        blurOnSubmit={false}
                        onBlur={ensureFocus}
                        selectTextOnFocus={true}
                    />
                </View>

                <View style={styles.listCard}>
                    <ScrollView horizontal style={{ flex: 1 }}>
                        <View>
                            <View style={styles.listHeader}>
                                <Text style={[styles.headerCell, { width: 180 }]}>SCAN BARCODE</Text>
                                <Text style={[styles.headerCell, { width: 180 }]}>PALLET CODE</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>COLOR</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>IMEI1</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>IMEI2</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>IMEI3</Text>
                                <Text style={[styles.headerCell, { width: 80 }]}>TYPE</Text>
                                <Text style={[styles.headerCell, { width: 80 }]}>QTY</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>BOX CODE</Text>
                            </View>

                            <FlatList
                                data={items}
                                renderItem={renderItem}
                                keyExtractor={(item, index) => `${item.scanBarCode}-${index}`}
                                ListEmptyComponent={
                                    <View style={{ width: Dimensions.get('window').width - 32 }}>
                                        <Text style={styles.emptyText}>No items found.</Text>
                                    </View>
                                }
                            />
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.totalQtyBox}>
                    <Text style={styles.totalQtyLabel}>Total Qty:</Text>
                    <Text style={styles.totalQtyValue}>{qtyTotal}</Text>
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc"} />
                </View>
            )}
        </SafeAreaView>
    );
}

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const createStyles = (factoryColor: string) => StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        backgroundColor: factoryColor,
        paddingHorizontal: width * 0.05,
        height: scale(56),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 4,
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    card: {
        backgroundColor: "#FFF",
        borderRadius: 16,
        padding: 10,
        marginBottom: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: factoryColor,
    },
    inputGroup: { marginBottom: 12 },
    input: {
        backgroundColor: "#e2f0eeff",
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600",
        borderWidth: 1,
        borderColor: factoryColor,
    },
    totalQtyBox: { backgroundColor: factoryColor, padding: 12, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 12 },
    totalQtyLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
    totalQtyValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
    listCard: {
        flex: 1,
        backgroundColor: "#FFF",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: factoryColor,
        marginBottom: 8,
    },
    listHeader: {
        flexDirection: "row",
        backgroundColor: factoryColor,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    headerCell: {
        fontSize: 11,
        fontWeight: "800",
        color: "#FFFFFF",
        textAlign: "center",
        paddingHorizontal: 4,
    },
    row: {
        flexDirection: "row",
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        alignItems: "center",
    },
    cell: {
        fontSize: 11,
        color: "#1E293B",
        textAlign: "center",
        fontWeight: "600",
        paddingHorizontal: 4,
    },
    emptyText: {
        textAlign: "center",
        padding: 40,
        color: "#94A3B8",
        fontStyle: "italic",
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        paddingTop: 4,
    },
    exitButton: {
        height: 45,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#64748B",
    },
    exitButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
    },
});