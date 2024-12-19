type FetchProps = RequestInit & {
    body? : object
}

export const customFetch = async (url : string, options? : FetchProps) : Promise<Response> => {
    const defaultHeaders = {
        // 'X-Picsart-Plugin': 'Figma',
    };

    let updatedOptions: FetchProps = {
        ...(options || {}), 
        headers: { ...(options?.headers || {}), ...defaultHeaders },
    };
    console.log(url, updatedOptions);
    return await fetch(url, updatedOptions);
}