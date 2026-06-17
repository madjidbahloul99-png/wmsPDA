import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Dimensions,
    Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AllocateInItem {
    systemAllocateCode: string;   
    model: string;
    color: string;
    qty: number;
    outqty: number;
    inqty: number;
    cyqty: number;
    fromWareHouse: string;
    toWareHouse: string;
    allocateCode: string;
}

export default function AllocateInNO({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userName, operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [sn, setSn] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [items, setItems] = useState<AllocateInItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [f_systemAllocateCode, setFSystemAllocateCode] = useState("");
    const [showKeyboard, setShowKeyboard] = useState(false);

    const snRef = useRef<TextInput>(null);
    const scanTimer = useRef<any>(null);

    const ensureFocus = () => {
        if (snRef.current) {
            snRef.current.focus();
        }
    };

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN AllocateIN", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);

    useEffect(() => {
        snRef.current?.focus();
    }, []);

    const fetchAllocateInModelList = async (systemAllocateCode: string) => {
        setErrorMsg("");
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/AllocateInModel`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    FactoryCode: gs_factoryCode,
                    SystemAllocateCode: systemAllocateCode,
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
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
            const newItems: AllocateInItem[] = [];
            let tock = "";
             console.log("result  AllocateIN", result);

            if (result && result.message === 'success' && result.data) {
                result.data.forEach((row: any) => {
                    newItems.push({
                        systemAllocateCode: systemAllocateCode,
                        model: row.model,
                        color: row.color,
                        qty: parseInt(row.qty),
                        outqty: parseInt(row.outqty),
                        inqty: parseInt(row.inqty),
                        cyqty: parseInt(row.cyqty),
                        fromWareHouse: row.fromWareHouse,
                        toWareHouse: row.toWareHouse,
                        allocateCode: row.allocateCode,
                    });
                    tock = row.toWareHouse;
                });
            }

            setItems(newItems);

            if (tock !== "" && tock !== gs_wareCode) {
                setErrorMsg("To WareHouse Must be Login WareHouse " + gs_wareCode);
                setItems([]);
                setFSystemAllocateCode("");
                snRef.current?.focus();
                console.log("API toWareHouse:", tock);
                console.log("Login wareHouse:", gs_wareCode);
                return;
            }

            setFSystemAllocateCode(systemAllocateCode);

        } catch (err: any) {
            setErrorMsg("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };


    useFocusEffect(
        React.useCallback(() => {
            if (f_systemAllocateCode) {
                fetchAllocateInModelList(f_systemAllocateCode);
            }
        }, [f_systemAllocateCode])
    );

    const handleSnChange = (text: string) => {
        setSn(text);
        if (text.includes('\n') || text.includes('\r')) {
            handleSnSubmit(text.trim());
            return;
        }

        if (scanTimer.current) clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
            if (text.trim().length > 0) {
                handleSnSubmit(text.trim());
            }
        }, 200);
    };

    const handleSnSubmit = (text?: string) => {
        const code = (text || sn).trim().toUpperCase();
        if (code.length > 0) {
            //setSn("");
            if (scanTimer.current) clearTimeout(scanTimer.current);
            fetchAllocateInModelList(code);
        }
    };

    const handleKeyPress = (e: any) => {
        if (e.nativeEvent.key === 'Tab') {
            handleSnSubmit();
        }
    };

    const handleChoice = () => {
        if (selectedIndex === null || !items[selectedIndex]) {
            setErrorMsg("Please select an item first");
            return;
        }

        const selectedItem = items[selectedIndex];

        const allocateCode = selectedItem.allocateCode;
        navigation.navigate('AllocateInFrm', { allocateCode });
    };

    const renderItem = ({ item, index }: { item: AllocateInItem; index: number }) => {
        let textColor = "#334155";
        if (item.cyqty > 0) {
            textColor = item.inqty > 0 ? "#2563EB" : "#EF4444";
        }
        const isSelected = selectedIndex === index;

        return (
            <TouchableOpacity
                key={item.allocateCode + "_" + index}
                style={[
                    styles.tableRow,
                    index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
                    isSelected && styles.selectedRow
                ]}
                onPress={() => setSelectedIndex(index)}
            >
                <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.systemAllocateCode}</Text>
                <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.model}</Text>
                <Text style={[styles.cell, { color: textColor, width: 150 }]}>{item.color}</Text>
                <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.qty}</Text>
                <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.outqty}</Text>
                <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.inqty}</Text>
                <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.cyqty}</Text>
                <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.fromWareHouse}</Text>
                <Text style={[styles.cell, { color: textColor, width: 150 }]}>{item.toWareHouse}</Text>
                <Text style={[styles.cell, { color: textColor, width: 240 }]}>{item.allocateCode}</Text>
            </TouchableOpacity>
        );
    };

    const handleReturn = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>AllocateIn Scann</Text>
                </View>

                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>

                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                <TextInput
                    ref={snRef}
                    style={styles.input}
                    value={sn}
                    onChangeText={handleSnChange}
                    //onSubmitEditing={() => handleSnSubmit()}
                    onKeyPress={handleKeyPress}
                    placeholder="BON NO"
                    placeholderTextColor="#334155"
                    autoCapitalize="characters"
                    showSoftInputOnFocus={showKeyboard}
                    blurOnSubmit={false}
                    onBlur={ensureFocus}
                />

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 120 }]}>BON NO</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>Out</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>In</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>Diff</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>From</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>To</Text>
                                <Text style={[styles.headerCell, { width: 240 }]}>Allocate</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {items.length === 0 ? (
                                    <Text style={styles.emptyText}>Waiting for Scanning...</Text>
                                ) : (
                                    items.map((item, index) => (
                                        <React.Fragment key={item.allocateCode + "_" + index}>
                                            {renderItem({ item, index })}
                                        </React.Fragment>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.primaryButton} onPress={handleChoice}>
                        <Text style={styles.primaryButtonText}>Choice</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const { width, height } = Dimensions.get("window");
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
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    returnLogo: {
        width: scale(24),
        height: scale(24),
        marginRight: 10,
        tintColor: "#FFFFFF",
    },
    headerTitle: {
        color: "#FFFFFF",
        fontSize: isSmallDevice ? scale(14) : scale(16),
        fontWeight: "900",
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    userNameText: {
        color: "#FFFFFF",
        fontSize: scale(12),
        fontWeight: "700",
        marginRight: 1,
    },
    content: { flex: 1, padding: 16 },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc", marginBottom: 16, marginHorizontal: -6 },
    input: {
        backgroundColor: "#e2f0eeff",
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600",
        borderWidth: 1,
        borderColor: "#0052cc",
        marginBottom: 12
    },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 12, color: "#334155", textAlign: "center", fontWeight: "600" },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 830 },
    actions: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
    primaryButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0052cc' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    errorText: { color: "#EF4444", fontSize: 12, marginBottom: 8, fontWeight: "700" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
});
