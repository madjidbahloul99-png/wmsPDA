import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function DistributorReturnNo({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareCode } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [txtSN, setTxtSN] = useState("");
    const [itemList, setItemList] = useState<any[]>([]);
    const [label_error, setLabelError] = useState("");
    const [f_orderId, setFOrderId] = useState("");

    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
        setTimeout(() => inputRef.current?.focus(), 500);
    }, []);

    const DistributorReturnModelList = async (id: string) => {
        if (!id) return;
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DistributorReturnModel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    orderId: id
                }),
            });

            const result = await response.json();

            if (result.message === "success" && result.data) {
                const data = result.data;
                setItemList(data);
                
                if (data.length > 0) {
                    const firstItem = data[0];
                    const tock = firstItem.tock;
                    
                    if (!((tock === "") || (tock === gs_wareCode))) {
                        if (tock === "0") {
                            setLabelError("The order not exists");
                        } else {
                            setLabelError("The order have in warehouse: " + tock);
                        }
                        setTxtSN("");
                        setItemList([]);
                        setFOrderId("");
                        return;
                    }

                    setLabelError("Distributor: " + firstItem.fromDistributor + " " + firstItem.fromDistributorName);
                    setFOrderId(id);
                } else {
                    setLabelError("");
                    setFOrderId("");
                }
            } else {
                setItemList([]);
                setLabelError("");
                setFOrderId("");
                Alert.alert("Error", result.data || "No data found");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const btnChoice_Click = () => {
        if (!f_orderId) {
            Alert.alert("Error", "Please scan a valid order ID first");
            return;
        }
        navigation.navigate("DistributorReturn", { f_orderId: f_orderId });
    };

    // Refresh data when returning from DistributorReturn
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (f_orderId) {
                DistributorReturnModelList(f_orderId);
            }
        });
        return unsubscribe;
    }, [navigation, f_orderId, token]);

    const getItemColor = (item: any) => {
        const cyqty = parseInt(item.cyqty) || 0;
        const inqty = parseInt(item.inqty) || 0;
        if (cyqty > 0) {
            return inqty > 0 ? "#0052cc" : "#EF4444"; // Blue for partial, Red for none
        }
        return "#334155";
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} id="button_exit">
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Distributor Return NO</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.inputSection}>
                    <View style={styles.scanInputContainer}>
                        <TextInput
                            ref={inputRef}
                            id="txtSN"
                            style={styles.scanInput}
                            placeholder="BON NO..."
                            value={txtSN}
                            onChangeText={setTxtSN}
                            onSubmitEditing={() => DistributorReturnModelList(txtSN)}
                            blurOnSubmit={false}
                            placeholderTextColor="#1E293B"
                        />
                    </View>
                </View>

                {label_error ? (
                    <View style={styles.infoBanner}>
                        <Text style={styles.infoText}>{label_error}</Text>
                    </View>
                ) : null}

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 120 }]}>BON NO</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>color</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>qty</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>inqty</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>errqty</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Defference</Text>
                                <Text style={[styles.headerCell, { width: 160 }]}>from Distributor</Text>
                                <Text style={[styles.headerCell, { width: 200 }]}>from DistributorName</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <View style={{ width: 860, marginTop: 40 }}>
                                        <ActivityIndicator size="large" color="#0052cc" />
                                    </View>
                                ) : itemList.length === 0 ? (
                                    <View style={{ width: 860, padding: 40 }}>
                                        <Text style={styles.emptyText}>No plan data!</Text>
                                    </View>
                                ) : (
                                    itemList.map((item, index) => (
                                        <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
                                            <Text style={[styles.cell, { width: 120, color: getItemColor(item) }]}>{f_orderId}</Text>
                                            <Text style={[styles.cell, { width: 130, color: getItemColor(item) }]}>{item.model}</Text>
                                            <Text style={[styles.cell, { width: 100, color: getItemColor(item) }]}>{item.color}</Text>
                                            <Text style={[styles.cell, { width: 60, color: getItemColor(item) }]}>{item.qty}</Text>
                                            <Text style={[styles.cell, { width: 60, color: getItemColor(item) }]}>{item.inqty}</Text>
                                            <Text style={[styles.cell, { width: 60, color: getItemColor(item) }]}>{item.errqty}</Text>
                                            <Text style={[styles.cell, { width: 100, color: getItemColor(item) }]}>{item.cyqty}</Text>
                                            <Text style={[styles.cell, { width: 160, color: getItemColor(item) }]}>{item.fromDistributor}</Text>
                                            <Text style={[styles.cell, { width: 200, color: getItemColor(item) }]}>{item.fromDistributorName}</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        id="btnChoice"
                        style={[styles.actionBtn, !f_orderId && styles.disabledBtn]}
                        onPress={btnChoice_Click}
                        disabled={!f_orderId || loading}
                    >
                        <Text style={styles.actionBtnText}>Scan Box/SN</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { backgroundColor: "#0052cc", paddingHorizontal: width * 0.05, height: scale(56), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    inputSection: { marginBottom: 8 },
    scanInputContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, height: 40, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#0052cc' },
    scanInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B' },
    infoBanner: { backgroundColor: '#E0F2FE', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#7DD3FC' },
    infoText: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0",marginBottom:6 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 4 },
    emptyText: { textAlign: "center", color: "#94A3B8", fontStyle: "italic" },
    footer: { marginTop: 8 },
    actionBtn: { backgroundColor: "#0052cc", padding: 12, borderRadius: 10, alignItems: "center", height: 44, elevation: 2 },
    actionBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
    disabledBtn: { opacity: 0.6 },
});
