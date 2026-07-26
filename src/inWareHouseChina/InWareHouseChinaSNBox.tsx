import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    StatusBar,
    ActivityIndicator,
    Image,
    Dimensions,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as inWareHouseChinaClient from "./inWareHouseChinaClient";

interface SNBoxItem {
    id: string;
    fxh: string;
    orderCode: string;
    boxCode: string;
    model: string;
    color: string;
    qty: string;
}

export default function InWareHouseChinaSNBox({ navigation, route }: any) {
    const f_palletCode = route.params?.f_palletCode ?? "";

    const {
        gs_MESBaseURL,
        gs_wareCode,
        gs_wareType,
        gs_factoryCodeMES,
        gs_userCode,
        gs_userName,
    } = useGlobalStr();

    const [items, setItems] = useState<SNBoxItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [qtyTotal, setQtyTotal] = useState(0);

    useEffect(() => {
        if (gs_wareType !== "MainWarehouse") {
            pubfunction.ShowError("Only the main warehouse can be put in storage!");
            return;
        }

        getPalletSNConfirm(f_palletCode);
    }, []);

    const getPalletSNConfirm = async (palletCode: string) => {
        setLoading(true);
        try {
            const res = await inWareHouseChinaClient.inPalletSNBoxChina(
                gs_MESBaseURL, gs_factoryCodeMES, gs_wareCode, palletCode
            );

            if (res && res.success && res.list) {
                const list = res.list;
                let total = list.length;
                if (list.length > 0) {
                    const mappedItems: SNBoxItem[] = list.map((item: any, index: number) => ({
                        id: String(index),
                        fxh: item.fxh || "",
                        orderCode: item.orderCode || "",
                        boxCode: item.boxCode || "",
                        model: item.model || "",
                        color: item.color || "",
                        qty: item.qty || "",
                    }));
                    setItems(mappedItems);
                    setQtyTotal(total);
                } else {
                    pubfunction.ShowError("There is no product in the Pallet!");
                    setQtyTotal(0);
                }
            }
        } catch (err: any) {
            console.error(err);
            pubfunction.ShowError(err.message || "Network Error");
        } finally {
            setLoading(false);
        }
    };

    const handleExitClick = () => {
        navigation.goBack();
    };

    const renderItem = ({ item, index }: { item: SNBoxItem; index: number }) => {
        return (
            <View
                style={[
                    styles.row,
                    { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
                ]}
            >
                <Text style={[styles.cell, { flex: 0.8 }]}>{item.fxh}</Text>
                <Text style={[styles.cell, { flex: 1.5 }]}>{item.orderCode}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{item.boxCode}</Text>
                <Text style={[styles.cell, { flex: 1.2 }]}>{item.model}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{item.color}</Text>
                <Text style={[styles.cell, { flex: 0.8 }]}>{item.qty}</Text>
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
                    <Text style={styles.headerTitle}>In China SN Box</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.statusLabelCard}>
                    <Text style={styles.statusLabelText}>Total qty:{qtyTotal}</Text>
                </View>

                <View style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <Text style={[styles.headerCell, { flex: 0.8 }]}>No</Text>
                        <Text style={[styles.headerCell, { flex: 1.5 }]}>ORDER</Text>
                        <Text style={[styles.headerCell, { flex: 2 }]}>BOX CODE</Text>
                        <Text style={[styles.headerCell, { flex: 1.2 }]}>MODEL</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>COLOR</Text>
                        <Text style={[styles.headerCell, { flex: 0.8 }]}>QTY</Text>
                    </View>

                    <FlatList
                        data={items}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => `${item.boxCode}-${index}`}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No items found.</Text>
                        }
                    />
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.exitButton} onPress={handleExitClick}>
                        <Text style={styles.exitButtonText}>Exit</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#0052cc" />
                </View>
            )}
        </SafeAreaView>
    );
}

const { width } = Dimensions.get("window");
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
    headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    statusLabelCard: {
        backgroundColor: "#FFF",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#0052cc",
        marginBottom: 8,
        alignItems: "center",
    },
    statusLabelText: {
        color: "#0052cc",
        fontSize: 13,
        fontWeight: "900",
    },
    listCard: {
        flex: 1,
        backgroundColor: "#FFF",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#0052cc",
        marginBottom: 8,
    },
    listHeader: {
        flexDirection: "row",
        backgroundColor: "#0052cc",
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    headerCell: {
        fontSize: 11,
        fontWeight: "800",
        color: "#FFFFFF",
        textAlign: "center",
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
